use keyring::{Entry, Error};

const SERVICE_NAME: &str = "dev.displace.desktop";
const REFRESH_TOKEN_ACCOUNT: &str = "refresh-token";

pub fn clear_refresh_token() -> Result<(), CredentialError> {
    match entry()?.delete_credential() {
        Ok(()) | Err(Error::NoEntry) => Ok(()),
        Err(_) => Err(CredentialError::Unavailable),
    }
}

pub fn has_refresh_token() -> Result<bool, CredentialError> {
    match entry()?.get_password() {
        Ok(_) => Ok(true),
        Err(Error::NoEntry) => Ok(false),
        Err(_) => Err(CredentialError::Unavailable),
    }
}

pub fn store_refresh_token(refresh_token: &str) -> Result<(), CredentialError> {
    if refresh_token.is_empty() {
        return Err(CredentialError::EmptySecret);
    }
    entry()?
        .set_password(refresh_token)
        .map_err(|_| CredentialError::Unavailable)
}

fn entry() -> Result<Entry, CredentialError> {
    Entry::new(SERVICE_NAME, REFRESH_TOKEN_ACCOUNT).map_err(|_| CredentialError::Unavailable)
}

#[derive(Debug, PartialEq)]
pub enum CredentialError {
    EmptySecret,
    Unavailable,
}

impl std::fmt::Display for CredentialError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::EmptySecret => formatter.write_str("A refresh token is required."),
            Self::Unavailable => formatter.write_str("Secure credential storage is unavailable."),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_empty_secrets_before_accessing_the_os_store() {
        assert_eq!(store_refresh_token(""), Err(CredentialError::EmptySecret));
    }
}
