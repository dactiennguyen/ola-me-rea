// Refresh tokens are separate from accounts.json and account exports.
use keyring::Entry;

/// The vault key is an account id, which newAccount (src/lib/accounts.ts) makes as `acc_<hex>`:
/// letters, digits, '_' and '-'. Anything else is not an id this app produced.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 128
        && id
            .bytes()
            .all(|b| b.is_ascii_alphanumeric() || b == b'-' || b == b'_')
}

fn entry(app: &tauri::AppHandle, id: &str) -> Result<Entry, String> {
    if !valid_id(id) {
        return Err("Mã tài khoản không hợp lệ.".into());
    }
    Entry::new(&format!("{}.google-session", app.config().identifier), id)
        .map_err(|_| "Không mở được kho bảo mật hệ điều hành.".into())
}

#[tauri::command]
pub fn google_session_get(app: tauri::AppHandle, id: String) -> Result<String, String> {
    entry(&app, &id)?.get_password().map_err(|_| {
        "Không tìm thấy phiên Google trong kho bảo mật. Hãy nhập lại file từ Android.".into()
    })
}

#[tauri::command]
pub fn google_session_set(app: tauri::AppHandle, id: String, token: String) -> Result<(), String> {
    if token.len() < 20 || token.len() > 8192 || token.chars().any(char::is_control) {
        return Err("Phiên Google không hợp lệ.".into());
    }
    entry(&app, &id)?
        .set_password(&token)
        .map_err(|_| "Không lưu được phiên vào kho bảo mật hệ điều hành.".into())
}

#[tauri::command]
pub fn google_session_delete(app: tauri::AppHandle, id: String) -> Result<(), String> {
    match entry(&app, &id)?.delete_credential() {
        Ok(()) | Err(keyring::Error::NoEntry) => Ok(()),
        Err(_) => Err("Không xoá được phiên trong kho bảo mật.".into()),
    }
}

#[cfg(test)]
mod tests {
    use super::valid_id;

    #[test]
    fn accepts_ids_newaccount_produces() {
        // src/lib/accounts.ts: `acc_${randomHex(6)}` — the '_' must be allowed.
        assert!(valid_id("acc_1a2b3c"));
        assert!(valid_id("acc_0f9e8d"));
        assert!(valid_id("acc-legacy"));
    }

    #[test]
    fn rejects_empty_overlong_or_foreign_characters() {
        assert!(!valid_id(""));
        assert!(!valid_id(&"a".repeat(129)));
        assert!(!valid_id("acc/../secret"));
        assert!(!valid_id("acc.1"));
        assert!(!valid_id("acc 1"));
    }
}
