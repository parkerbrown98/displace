use serde::Serialize;
use serde_json::{json, Value};
use url::Url;

use crate::credentials;

#[derive(Default)]
pub struct NativeAuthState(tokio::sync::Mutex<()>);

impl NativeAuthState {
    pub(crate) async fn lock(&self) -> tokio::sync::MutexGuard<'_, ()> {
        self.0.lock().await
    }
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeAuthError {
    kind: &'static str,
    detail: String,
}

impl NativeAuthError {
    pub fn invalid_oidc(_error: String) -> Self {
        Self::new(
            "unauthenticated",
            "The sign-in response is invalid or expired.",
        )
    }

    fn new(kind: &'static str, detail: impl Into<String>) -> Self {
        Self {
            kind,
            detail: detail.into(),
        }
    }
}

#[tauri::command]
pub async fn clear_refresh_token(state: tauri::State<'_, NativeAuthState>) -> Result<(), String> {
    let _guard = state.0.lock().await;
    credentials::clear_refresh_token().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn has_refresh_token(state: tauri::State<'_, NativeAuthState>) -> Result<bool, String> {
    let _guard = state.0.lock().await;
    credentials::has_refresh_token().map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn store_refresh_token(
    state: tauri::State<'_, NativeAuthState>,
    refresh_token: String,
) -> Result<(), String> {
    let _guard = state.0.lock().await;
    credentials::store_refresh_token(&refresh_token).map_err(|error| error.to_string())
}

#[tauri::command]
pub async fn refresh_authentication(
    state: tauri::State<'_, NativeAuthState>,
    api_origin: String,
) -> Result<Option<Value>, NativeAuthError> {
    let _guard = state.0.lock().await;
    let Some(refresh_token) = credentials::read_refresh_token()
        .map_err(|error| NativeAuthError::new("unavailable", error.to_string()))?
    else {
        return Ok(None);
    };
    let result = request_authentication(
        &api_origin,
        "/api/v1/auth/refresh",
        json!({
            "refreshToken": refresh_token,
            "refreshTokenDelivery": "response_body",
        }),
    )
    .await;
    match result {
        Ok(authentication) => store_and_redact(authentication).map(Some),
        Err(error) if matches!(error.kind, "unauthenticated" | "forbidden") => {
            credentials::clear_refresh_token()
                .map_err(|error| NativeAuthError::new("unavailable", error.to_string()))?;
            Ok(None)
        }
        Err(error) => Err(error),
    }
}

pub async fn exchange_oidc(
    auth_state: &NativeAuthState,
    api_origin: &str,
    callback_url: &str,
    code_verifier: &str,
    nonce: &str,
    state: &str,
) -> Result<Value, NativeAuthError> {
    let _guard = auth_state.0.lock().await;
    let authentication = request_authentication(
        api_origin,
        "/api/v1/auth/oidc/native/exchange",
        json!({
            "callbackUrl": callback_url,
            "codeVerifier": code_verifier,
            "nonce": nonce,
            "state": state,
        }),
    )
    .await?;
    store_and_redact(authentication)
}

async fn request_authentication(
    api_origin: &str,
    path: &str,
    body: Value,
) -> Result<Value, NativeAuthError> {
    let endpoint = api_endpoint(api_origin, path)?;
    let client = reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::none())
        .build()
        .map_err(|_| NativeAuthError::new("unknown", "The native HTTP client is unavailable."))?;
    let response = client
        .post(endpoint)
        .json(&body)
        .send()
        .await
        .map_err(|_| NativeAuthError::new("offline", "Displace could not reach the server."))?;
    let status = response.status();
    let response_body = response.json::<Value>().await.unwrap_or(Value::Null);
    if !status.is_success() {
        let kind = match status.as_u16() {
            401 => "unauthenticated",
            403 => "forbidden",
            429 => "rate-limited",
            500..=599 => "server",
            _ => "unknown",
        };
        let detail = response_body
            .get("detail")
            .and_then(Value::as_str)
            .unwrap_or("The authentication request could not be completed.");
        return Err(NativeAuthError::new(kind, detail));
    }
    Ok(response_body)
}

fn store_and_redact(mut authentication: Value) -> Result<Value, NativeAuthError> {
    let refresh_token = take_refresh_token(&mut authentication)?;
    credentials::store_refresh_token(&refresh_token)
        .map_err(|error| NativeAuthError::new("unavailable", error.to_string()))?;
    Ok(authentication)
}

fn take_refresh_token(authentication: &mut Value) -> Result<String, NativeAuthError> {
    let refresh_token = authentication
        .get("refreshToken")
        .and_then(Value::as_str)
        .ok_or_else(|| {
            NativeAuthError::new(
                "server",
                "The server did not return a native refresh token.",
            )
        })?
        .to_owned();
    authentication
        .as_object_mut()
        .ok_or_else(|| NativeAuthError::new("server", "The server returned an invalid response."))?
        .remove("refreshToken");
    Ok(refresh_token)
}

fn api_endpoint(api_origin: &str, path: &str) -> Result<Url, NativeAuthError> {
    let origin = Url::parse(api_origin)
        .map_err(|_| NativeAuthError::new("unknown", "The API origin is invalid."))?;
    let local_development = matches!(origin.host_str(), Some("localhost" | "127.0.0.1"));
    if origin.cannot_be_a_base()
        || origin.username() != ""
        || origin.password().is_some()
        || origin.path() != "/"
        || origin.query().is_some()
        || origin.fragment().is_some()
        || (origin.scheme() != "https" && !(cfg!(debug_assertions) && local_development))
    {
        return Err(NativeAuthError::new(
            "unknown",
            "The API origin is not allowed.",
        ));
    }
    let expected_origin = option_env!("VITE_API_ORIGIN").or(if cfg!(debug_assertions) {
        Some("http://localhost:3001")
    } else {
        None
    });
    if expected_origin.map(|value| value.trim_end_matches('/'))
        != Some(origin.as_str().trim_end_matches('/'))
    {
        return Err(NativeAuthError::new(
            "unknown",
            "The API origin does not match this application build.",
        ));
    }
    origin
        .join(path)
        .map_err(|_| NativeAuthError::new("unknown", "The API endpoint is invalid."))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn redacts_refresh_tokens_from_authentication_responses() {
        let mut authentication = json!({
            "accessToken": "access-token",
            "refreshToken": "refresh-token",
        });

        assert_eq!(
            take_refresh_token(&mut authentication).unwrap(),
            "refresh-token"
        );
        assert_eq!(authentication, json!({ "accessToken": "access-token" }));
    }

    #[test]
    fn rejects_renderer_selected_origins_and_non_origins() {
        let expected = option_env!("VITE_API_ORIGIN").unwrap_or("http://localhost:3001");

        assert!(api_endpoint(expected, "/api/v1/auth/refresh").is_ok());
        assert!(api_endpoint("https://attacker.example", "/api/v1/auth/refresh").is_err());
        assert!(api_endpoint(&format!("{expected}/nested"), "/api/v1/auth/refresh").is_err());
    }
}
