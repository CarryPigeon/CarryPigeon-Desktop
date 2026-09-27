//! ai｜DI/命令入口：commands。
//!
//! 说明：
//! - 命令层负责构造适配器（`KeyringAiSecretStore` / `ReqwestAiClient`）并做错误码映射；
//! - 入参保持平铺（Tauri 默认把 snake_case 参数映射为前端 camelCase 键）；
//! - 用例层的“业务失败”通过出参 `ok = false` 返回，只有参数校验/存储故障才是 IPC 报错。
//!
//! 约定：注释中文，日志英文（tracing）。

use crate::features::ai::data::keyring_secret_store::KeyringAiSecretStore;
use crate::features::ai::data::reqwest_ai_client::ReqwestAiClient;
use crate::features::ai::di::models::{
    AiChatCompletionResult, AiChatMessageArgs, AiListModelsResult, AiSecretStatusResult,
};
use crate::features::ai::domain::model::{AiChatMessage, AiValidationError};
use crate::features::ai::usecases::{self, AiChatCompletionInput, AiListModelsInput};
use crate::shared::error::{CommandResult, to_command_error};
use crate::shared::secure_store;

/// 保存（覆盖）指定 provider 的 API Key。
///
/// # 参数
/// - `provider_id`：provider 标识（前端键 `providerId`，白名单字符且不超过 64 字符）。
/// - `api_key`：API Key 明文（仅经 IPC 传入，保存在系统 keyring，不落库、不进日志）。
///
/// # 返回值
/// - `Ok(())`：保存成功（前端得到 `null`）。
/// - `Err(String)`：`[AI_INVALID_PROVIDER_ID]` / `[AI_INVALID_REQUEST]` /
///   `[AI_SECRET_STORE_UNAVAILABLE]` / `[AI_SECRET_SET_FAILED]`。
#[tauri::command]
pub async fn ai_secret_set(provider_id: String, api_key: String) -> CommandResult<()> {
    let port = KeyringAiSecretStore::shared();
    usecases::ai_secret_set(&provider_id, &api_key, port.as_ref())
        .map_err(|e| map_ai_error(e, "AI_SECRET_SET_FAILED", "error.ai_secret_set_failed"))
}

/// 查询指定 provider 的密钥配置状态（不返回密钥内容）。
///
/// # 参数
/// - `provider_id`：provider 标识（前端键 `providerId`）。
///
/// # 返回值
/// - `Ok(AiSecretStatusResult)`：`{ configured, secureStorageAvailable }`。
/// - `Err(String)`：`[AI_INVALID_PROVIDER_ID]` / `[AI_SECRET_STORE_UNAVAILABLE]`。
#[tauri::command]
pub async fn ai_secret_status(provider_id: String) -> CommandResult<AiSecretStatusResult> {
    let port = KeyringAiSecretStore::shared();
    usecases::ai_secret_status(&provider_id, port.as_ref())
        .map(|status| AiSecretStatusResult {
            configured: status.configured,
            secure_storage_available: status.secure_storage_available,
        })
        .map_err(|e| {
            map_ai_error(
                e,
                "AI_SECRET_STORE_UNAVAILABLE",
                "error.ai_secret_store_unavailable",
            )
        })
}

/// 清除指定 provider 的密钥（幂等：未配置时同样返回成功）。
///
/// # 参数
/// - `provider_id`：provider 标识（前端键 `providerId`）。
///
/// # 返回值
/// - `Ok(())`：清除成功（前端得到 `null`）。
/// - `Err(String)`：`[AI_INVALID_PROVIDER_ID]` / `[AI_SECRET_STORE_UNAVAILABLE]` /
///   `[AI_SECRET_CLEAR_FAILED]`。
#[tauri::command]
pub async fn ai_secret_clear(provider_id: String) -> CommandResult<()> {
    let port = KeyringAiSecretStore::shared();
    usecases::ai_secret_clear(&provider_id, port.as_ref())
        .map_err(|e| map_ai_error(e, "AI_SECRET_CLEAR_FAILED", "error.ai_secret_clear_failed"))
}

/// 执行一次 OpenAI 兼容聊天补全。
///
/// # 参数
/// - `provider_id`：provider 标识（前端键 `providerId`）。
/// - `base_url`：上游 base url（前端键 `baseUrl`，仅支持 http/https）。
/// - `model` / `messages`：模型名与消息列表。
/// - `temperature` / `max_tokens` / `timeout_ms`：可选项（前端键 `maxTokens` / `timeoutMs`）。
/// - `requires_api_key`：是否要求必须配置密钥（前端键 `requiresApiKey`，缺省为 false）。
///
/// # 返回值
/// - `Ok(AiChatCompletionResult)`：业务结果（`ok = false` 表示上游/配置失败，含已打码的 `error`）。
/// - `Err(String)`：`[AI_INVALID_*]` / `[AI_REQUEST_FAILED]`。
#[tauri::command]
pub async fn ai_chat_completion(
    provider_id: String,
    base_url: String,
    model: String,
    messages: Vec<AiChatMessageArgs>,
    temperature: Option<f64>,
    max_tokens: Option<u32>,
    timeout_ms: Option<u64>,
    requires_api_key: Option<bool>,
) -> CommandResult<AiChatCompletionResult> {
    let input = AiChatCompletionInput {
        provider_id,
        base_url,
        model,
        messages: messages
            .into_iter()
            .map(|message| AiChatMessage {
                role: message.role,
                content: message.content,
            })
            .collect(),
        temperature,
        max_tokens,
        timeout_ms,
        requires_api_key: requires_api_key.unwrap_or(false),
    };

    let secret_port = KeyringAiSecretStore::shared();
    let chat_port = ReqwestAiClient::shared();
    usecases::ai_chat_completion(input, chat_port.as_ref(), secret_port.as_ref())
        .await
        .map(|output| AiChatCompletionResult {
            ok: output.ok,
            status: output.status,
            content: output.content,
            model: output.model,
            prompt_tokens: output.prompt_tokens,
            completion_tokens: output.completion_tokens,
            error: output.error,
        })
        .map_err(|e| map_ai_error(e, "AI_REQUEST_FAILED", "error.ai_request_failed"))
}

/// 拉取 OpenAI 兼容模型列表。
///
/// # 参数
/// - `provider_id`：provider 标识（前端键 `providerId`）。
/// - `base_url`：上游 base url（前端键 `baseUrl`，仅支持 http/https）。
/// - `timeout_ms`：可选项（前端键 `timeoutMs`）。
/// - `requires_api_key`：是否要求必须配置密钥（前端键 `requiresApiKey`，缺省为 false）。
///
/// # 返回值
/// - `Ok(AiListModelsResult)`：业务结果（`ok = false` 表示上游/配置失败，含已打码的 `error`）。
/// - `Err(String)`：`[AI_INVALID_*]` / `[AI_MODELS_REQUEST_FAILED]`。
#[tauri::command]
pub async fn ai_list_models(
    provider_id: String,
    base_url: String,
    timeout_ms: Option<u64>,
    requires_api_key: Option<bool>,
) -> CommandResult<AiListModelsResult> {
    let input = AiListModelsInput {
        provider_id,
        base_url,
        timeout_ms,
        requires_api_key: requires_api_key.unwrap_or(false),
    };

    let secret_port = KeyringAiSecretStore::shared();
    let models_port = ReqwestAiClient::shared();
    usecases::ai_list_models(input, models_port.as_ref(), secret_port.as_ref())
        .await
        .map(|output| AiListModelsResult {
            ok: output.ok,
            status: output.status,
            models: output.models,
            error: output.error,
        })
        .map_err(|e| {
            map_ai_error(
                e,
                "AI_MODELS_REQUEST_FAILED",
                "error.ai_models_request_failed",
            )
        })
}

/// 将用例层错误映射为稳定错误码（命令边界的唯一出口）。
///
/// 优先级：参数校验（`AI_INVALID_*`）→ 安全存储不可用（`AI_SECRET_STORE_UNAVAILABLE`）
/// → 各命令自身的失败码。
fn map_ai_error(err: anyhow::Error, failure_code: &'static str, failure_key: &str) -> String {
    let validation = err
        .downcast_ref::<AiValidationError>()
        .map(|error| (error.code(), error.i18n_key()));
    if let Some((code, i18n_key)) = validation {
        return to_command_error(code, i18n_key, err);
    }

    if secure_store::is_secure_storage_unavailable_error(&format!("{err}")) {
        return to_command_error(
            "AI_SECRET_STORE_UNAVAILABLE",
            "error.ai_secret_store_unavailable",
            err,
        );
    }

    to_command_error(failure_code, failure_key, err)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// 在指定 locale 下执行断言，结束后恢复原 locale（Rust 用例串行执行）。
    fn with_locale(locale: &str, assertions: impl FnOnce()) {
        let prev_locale = rust_i18n::locale();
        rust_i18n::set_locale(locale);
        assertions();
        rust_i18n::set_locale(&prev_locale);
    }

    #[test]
    fn maps_validation_errors_to_stable_codes() {
        with_locale("zh_cn", || {
            let err = anyhow::Error::new(AiValidationError::InvalidBaseUrl("bad".to_string()));
            let message = map_ai_error(err, "AI_REQUEST_FAILED", "error.ai_request_failed");
            assert_eq!(message, "[AI_INVALID_BASE_URL] AI 服务地址无效");

            let err = anyhow::Error::new(AiValidationError::InvalidProviderId("bad".to_string()));
            let message = map_ai_error(err, "AI_REQUEST_FAILED", "error.ai_request_failed");
            assert_eq!(message, "[AI_INVALID_PROVIDER_ID] AI 服务商标识无效");

            let err = anyhow::Error::new(AiValidationError::InvalidRequest("bad".to_string()));
            let message = map_ai_error(err, "AI_REQUEST_FAILED", "error.ai_request_failed");
            assert_eq!(message, "[AI_INVALID_REQUEST] AI 请求参数无效");
        });
    }

    #[test]
    fn maps_validation_errors_in_english_locale() {
        with_locale("en_us", || {
            let err = anyhow::Error::new(AiValidationError::InvalidBaseUrl("bad".to_string()));
            let message = map_ai_error(err, "AI_REQUEST_FAILED", "error.ai_request_failed");
            assert_eq!(message, "[AI_INVALID_BASE_URL] Invalid AI base url");
        });
    }

    #[test]
    fn maps_unavailable_storage_to_dedicated_code() {
        with_locale("zh_cn", || {
            let err = anyhow::anyhow!(
                "secure storage is unavailable: No default store has been set, so cannot search or create entries"
            );
            let message = map_ai_error(err, "AI_SECRET_SET_FAILED", "error.ai_secret_set_failed");
            assert_eq!(
                message,
                "[AI_SECRET_STORE_UNAVAILABLE] 安全存储不可用，无法保存 AI 密钥"
            );
        });
    }

    #[test]
    fn maps_other_errors_to_command_specific_code() {
        with_locale("zh_cn", || {
            let err = anyhow::anyhow!("Failed to write secure storage entry: boom");
            let message = map_ai_error(err, "AI_SECRET_SET_FAILED", "error.ai_secret_set_failed");
            assert_eq!(message, "[AI_SECRET_SET_FAILED] AI 密钥保存失败");
        });
    }
}
