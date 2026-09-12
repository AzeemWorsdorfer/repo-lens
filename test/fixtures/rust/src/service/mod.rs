mod auth;

pub const SERVICE_TAG: &str = "svc";

pub fn describe() -> &'static str {
    auth::tag()
}
