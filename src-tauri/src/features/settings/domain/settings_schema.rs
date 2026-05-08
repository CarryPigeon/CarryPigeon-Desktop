//! settings｜领域契约：settings_schema。
//!
//! 约定：注释中文，日志英文（tracing）。

use anyhow::Context;
use serde::{Deserialize, Serialize};

/// settings schema 版本号。
pub const SETTINGS_SCHEMA_VERSION: u32 = 1;

/// settings 字段所有权。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsOwnership {
    LocalCache,
    BackendAuthoritative,
    Derived,
}

/// settings 字段生效方式。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SettingsApplyMode {
    Live,
    Reload,
    Restart,
    BootstrapOnly,
    Derived,
}

/// settings 字段定义。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettingsFieldDefinition {
    pub key: &'static str,
    pub owner: SettingsOwnership,
    pub apply_mode: SettingsApplyMode,
    pub persisted: bool,
    pub mandatory: bool,
}

/// settings 分类定义。
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct SettingsTaxonomyGroup {
    pub id: &'static str,
    pub owner: SettingsOwnership,
    pub apply_mode: SettingsApplyMode,
    pub fields: &'static [SettingsFieldDefinition],
}

/// 设置页当前可见/可迁移字段的归类税表。
pub const SETTINGS_TAXONOMY: &[SettingsTaxonomyGroup] = &[
    SettingsTaxonomyGroup {
        id: "app-preferences",
        owner: SettingsOwnership::LocalCache,
        apply_mode: SettingsApplyMode::Live,
        fields: &[SettingsFieldDefinition {
            key: "theme",
            owner: SettingsOwnership::LocalCache,
            apply_mode: SettingsApplyMode::Live,
            persisted: true,
            mandatory: true,
        }],
    },
    SettingsTaxonomyGroup {
        id: "business-feature-settings",
        owner: SettingsOwnership::BackendAuthoritative,
        apply_mode: SettingsApplyMode::Live,
        fields: &[
            SettingsFieldDefinition {
                key: "emailNotifications",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Live,
                persisted: true,
                mandatory: true,
            },
            SettingsFieldDefinition {
                key: "desktopNotifications",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Live,
                persisted: true,
                mandatory: true,
            },
            SettingsFieldDefinition {
                key: "autoLogin",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Restart,
                persisted: true,
                mandatory: true,
            },
            SettingsFieldDefinition {
                key: "autoLaunch",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Restart,
                persisted: true,
                mandatory: true,
            },
            SettingsFieldDefinition {
                key: "closeToTray",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Live,
                persisted: true,
                mandatory: true,
            },
            SettingsFieldDefinition {
                key: "checkForUpdates",
                owner: SettingsOwnership::BackendAuthoritative,
                apply_mode: SettingsApplyMode::Live,
                persisted: true,
                mandatory: true,
            },
        ],
    },
    SettingsTaxonomyGroup {
        id: "local-cache-bootstrap",
        owner: SettingsOwnership::LocalCache,
        apply_mode: SettingsApplyMode::BootstrapOnly,
        fields: &[],
    },
    SettingsTaxonomyGroup {
        id: "backend-authoritative",
        owner: SettingsOwnership::BackendAuthoritative,
        apply_mode: SettingsApplyMode::Restart,
        fields: &[SettingsFieldDefinition {
            key: "serverList",
            owner: SettingsOwnership::BackendAuthoritative,
            apply_mode: SettingsApplyMode::Restart,
            persisted: true,
            mandatory: true,
        }],
    },
    SettingsTaxonomyGroup {
        id: "derived-values",
        owner: SettingsOwnership::Derived,
        apply_mode: SettingsApplyMode::Derived,
        fields: &[],
    },
];

/// settings 主题（与前端 localStorage 主题保持一致）。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "lowercase")]
pub enum SettingsTheme {
    #[default]
    Patchbay,
    Legacy,
    Light,
}

/// settings 语言。
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, Default)]
pub enum SettingsLocale {
    #[default]
    #[serde(rename = "zh_cn")]
    ZhCn,
    #[serde(rename = "en_us")]
    EnUs,
}

/// 后端权威设置快照（版本 1）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsBackendStateV1 {
    pub auto_login: bool,
    pub auto_launch: bool,
    pub close_to_tray: bool,
    pub check_for_updates: bool,
    pub email_notifications: bool,
    pub desktop_notifications: bool,
    pub server_list: Vec<SettingsServerConfigV1>,
}

/// 本地缓存设置快照（版本 1）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
#[serde(default)]
pub struct SettingsLocalCacheStateV1 {
    pub theme: SettingsTheme,
    pub locale: SettingsLocale,
}

/// 服务器目录条目（版本 1）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsServerConfigV1 {
    pub server_socket: String,
    pub server_port: u16,
    pub server_name: String,
    pub account: String,
    pub user_name: String,
    pub user_avatar: String,
}

/// 版本化 settings 导入/导出信封（版本 1）。
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct SettingsImportEnvelopeV1 {
    pub schema_version: u32,
    pub backend: SettingsBackendStateV1,
    pub local_cache: SettingsLocalCacheStateV1,
}

/// 解析 settings 导入信封，并校验 schemaVersion。
pub fn parse_settings_import_envelope(raw: &str) -> anyhow::Result<SettingsImportEnvelopeV1> {
    let envelope: SettingsImportEnvelopeV1 =
        serde_json::from_str(raw).with_context(|| "Failed to parse settings import payload")?;
    if envelope.schema_version != SETTINGS_SCHEMA_VERSION {
        return Err(anyhow::anyhow!(
            "Unsupported settings schema version: {}",
            envelope.schema_version
        ));
    }
    Ok(envelope)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_payload() -> String {
        serde_json::json!({
            "schemaVersion": SETTINGS_SCHEMA_VERSION,
            "backend": {
                "autoLogin": false,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": [
                    {
                        "serverSocket": "socket://example.test:11443",
                        "serverPort": 11443,
                        "serverName": "Example",
                        "account": "",
                        "userName": "",
                        "userAvatar": ""
                    }
                ]
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string()
    }

    #[test]
    fn taxonomy_marks_expected_ownerships() {
        assert_eq!(SETTINGS_TAXONOMY.len(), 5);
        assert_eq!(SETTINGS_TAXONOMY[0].fields[0].key, "theme");
        assert_eq!(
            SETTINGS_TAXONOMY[0].fields[0].owner,
            SettingsOwnership::LocalCache
        );
        assert_eq!(SETTINGS_TAXONOMY[1].fields[0].key, "emailNotifications");
        assert_eq!(SETTINGS_TAXONOMY[1].fields[1].key, "desktopNotifications");
        assert_eq!(
            SETTINGS_TAXONOMY[1].fields[0].owner,
            SettingsOwnership::BackendAuthoritative
        );
        assert_eq!(SETTINGS_TAXONOMY[3].fields[0].key, "serverList");
        assert_eq!(
            SETTINGS_TAXONOMY[3].fields[0].owner,
            SettingsOwnership::BackendAuthoritative
        );
    }

    #[test]
    fn parse_settings_import_envelope_accepts_current_version() {
        let envelope =
            parse_settings_import_envelope(&valid_payload()).expect("payload should parse");
        assert_eq!(envelope.schema_version, SETTINGS_SCHEMA_VERSION);
        assert_eq!(envelope.local_cache.theme, SettingsTheme::Patchbay);
        assert_eq!(envelope.backend.server_list.len(), 1);
    }

    #[test]
    fn parse_settings_import_envelope_rejects_unsupported_version() {
        let payload = serde_json::json!({
            "schemaVersion": 999,
            "backend": {
                "autoLogin": false,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": []
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string();

        let error = parse_settings_import_envelope(&payload).expect_err("payload should fail");
        assert!(
            error
                .to_string()
                .contains("Unsupported settings schema version")
        );
    }

    #[test]
    fn parse_settings_import_envelope_rejects_unknown_fields() {
        let payload = serde_json::json!({
            "schemaVersion": SETTINGS_SCHEMA_VERSION,
            "backend": {
                "autoLogin": false,
                "autoLaunch": false,
                "closeToTray": true,
                "checkForUpdates": true,
                "emailNotifications": true,
                "desktopNotifications": false,
                "serverList": [],
                "unknownField": true
            },
            "localCache": {
                "theme": "patchbay"
            }
        })
        .to_string();

        let error = parse_settings_import_envelope(&payload).expect_err("payload should fail");
        assert!(
            error
                .to_string()
                .contains("Failed to parse settings import payload")
        );
    }
}
