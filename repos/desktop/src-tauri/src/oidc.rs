use base64::{engine::general_purpose::URL_SAFE_NO_PAD, Engine as _};
use rand::{rngs::OsRng, RngCore};
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::{
    sync::Mutex,
    time::{SystemTime, UNIX_EPOCH},
};
use url::Url;

use crate::native_auth::{self, NativeAuthError, NativeAuthState};

const TRANSACTION_TTL_SECONDS: u64 = 10 * 60;

#[derive(Debug)]
struct OidcTransaction {
    code_verifier: String,
    expires_at: u64,
    nonce: String,
    state: String,
}

#[derive(Default)]
pub struct OidcTransactionStore(Mutex<Option<OidcTransaction>>);

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OidcTransactionStart {
    callback_url: String,
    code_challenge: String,
    nonce: String,
    state: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OidcTransactionCompletion {
    callback_url: String,
    code_verifier: String,
    nonce: String,
    state: String,
}

#[tauri::command]
pub fn begin_oidc_transaction(
    callback_scheme: String,
    store: tauri::State<'_, OidcTransactionStore>,
) -> Result<OidcTransactionStart, String> {
    store.begin(&callback_scheme, now_seconds())
}

#[tauri::command]
pub async fn complete_oidc_authentication(
    callback_url: String,
    callback_scheme: String,
    store: tauri::State<'_, OidcTransactionStore>,
    auth_state: tauri::State<'_, NativeAuthState>,
    api_origin: String,
) -> Result<serde_json::Value, NativeAuthError> {
    let transaction = store
        .complete(&callback_url, &callback_scheme, now_seconds())
        .map_err(NativeAuthError::invalid_oidc)?;
    native_auth::exchange_oidc(
        &auth_state,
        &api_origin,
        &transaction.callback_url,
        &transaction.code_verifier,
        &transaction.nonce,
        &transaction.state,
    )
    .await
}

impl OidcTransactionStore {
    fn begin(&self, callback_scheme: &str, now: u64) -> Result<OidcTransactionStart, String> {
        validate_scheme(callback_scheme)?;
        let callback_url = format!("{callback_scheme}://auth/callback");
        let code_verifier = random_value();
        let code_challenge = URL_SAFE_NO_PAD.encode(Sha256::digest(code_verifier.as_bytes()));
        let nonce = random_value();
        let state = random_value();
        let transaction = OidcTransaction {
            code_verifier,
            expires_at: now + TRANSACTION_TTL_SECONDS,
            nonce: nonce.clone(),
            state: state.clone(),
        };
        *self.0.lock().map_err(|_| oidc_error())? = Some(transaction);
        Ok(OidcTransactionStart {
            callback_url,
            code_challenge,
            nonce,
            state,
        })
    }

    fn complete(
        &self,
        callback_url: &str,
        callback_scheme: &str,
        now: u64,
    ) -> Result<OidcTransactionCompletion, String> {
        validate_scheme(callback_scheme)?;
        let callback = Url::parse(callback_url).map_err(|_| oidc_error())?;
        if callback.scheme() != callback_scheme
            || callback.host_str() != Some("auth")
            || callback.path() != "/callback"
            || callback.fragment().is_some()
            || !callback.username().is_empty()
            || callback.password().is_some()
        {
            return Err(oidc_error());
        }
        let mut pending = self.0.lock().map_err(|_| oidc_error())?;
        let transaction = pending.take().ok_or_else(oidc_error)?;
        let state = single_query_value(&callback, "state")?;
        let code = single_query_value(&callback, "code")?;
        if now > transaction.expires_at || state != transaction.state || code.is_empty() {
            return Err(oidc_error());
        }
        Ok(OidcTransactionCompletion {
            callback_url: callback.to_string(),
            code_verifier: transaction.code_verifier,
            nonce: transaction.nonce,
            state: transaction.state,
        })
    }
}

fn random_value() -> String {
    let mut bytes = [0_u8; 32];
    OsRng.fill_bytes(&mut bytes);
    URL_SAFE_NO_PAD.encode(bytes)
}

fn single_query_value(url: &Url, name: &str) -> Result<String, String> {
    let values: Vec<_> = url.query_pairs().filter(|(key, _)| key == name).collect();
    if values.len() != 1 {
        return Err(oidc_error());
    }
    Ok(values[0].1.to_string())
}

fn validate_scheme(value: &str) -> Result<(), String> {
    let mut chars = value.chars();
    if !matches!(chars.next(), Some('a'..='z'))
        || !chars.all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || matches!(character, '+' | '-' | '.')
        })
        || matches!(value, "http" | "https")
    {
        return Err(oidc_error());
    }
    Ok(())
}

fn now_seconds() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs()
}

fn oidc_error() -> String {
    "The sign-in response is invalid or expired.".to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn consumes_a_valid_callback_once() {
        let store = OidcTransactionStore::default();
        let start = store.begin("displace-test", 100).unwrap();
        let callback = format!(
            "{}?code=provider-code&state={}",
            start.callback_url, start.state
        );

        assert!(store.complete(&callback, "displace-test", 101).is_ok());
        assert!(store.complete(&callback, "displace-test", 101).is_err());
    }

    #[test]
    fn rejects_and_consumes_a_state_mismatch() {
        let store = OidcTransactionStore::default();
        let start = store.begin("displace-test", 100).unwrap();
        let wrong = format!(
            "{}?code=provider-code&state={}",
            start.callback_url,
            random_value()
        );
        let valid = format!(
            "{}?code=provider-code&state={}",
            start.callback_url, start.state
        );

        assert!(store.complete(&wrong, "displace-test", 101).is_err());
        assert!(store.complete(&valid, "displace-test", 101).is_err());
    }

    #[test]
    fn rejects_expired_and_malformed_callbacks() {
        let store = OidcTransactionStore::default();
        let start = store.begin("displace-test", 100).unwrap();
        let callback = format!(
            "{}?code=provider-code&state={}",
            start.callback_url, start.state
        );
        assert!(store.complete(&callback, "displace-test", 701).is_err());

        let store = OidcTransactionStore::default();
        let start = store.begin("displace-test", 100).unwrap();
        let malformed = format!(
            "displace-test://other/callback?code=x&state={}",
            start.state
        );
        assert!(store.complete(&malformed, "displace-test", 101).is_err());
    }
}
