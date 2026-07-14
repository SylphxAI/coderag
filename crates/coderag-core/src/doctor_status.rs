//! Pure doctor status fold - mirrors
//! `packages/mcp-server/src/doctor.ts#runDoctor` aggregate (no FS probes).
//! product_effect_live=false; authority_rust=false; finish-line holds.

/// Per-check status (TS DoctorStatus).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoctorCheckStatus {
    Ok,
    Warn,
    Fail,
}

impl DoctorCheckStatus {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ok => "ok",
            Self::Warn => "warn",
            Self::Fail => "fail",
        }
    }

    #[must_use]
    pub fn parse(raw: &str) -> Option<Self> {
        match raw {
            "ok" => Some(Self::Ok),
            "warn" => Some(Self::Warn),
            "fail" => Some(Self::Fail),
            _ => None,
        }
    }
}

/// Aggregate report status (TS DoctorReport.status).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum DoctorReportStatus {
    Ready,
    Degraded,
    Unavailable,
}

impl DoctorReportStatus {
    #[must_use]
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Ready => "ready",
            Self::Degraded => "degraded",
            Self::Unavailable => "unavailable",
        }
    }
}

/// Fold checks to report status: any fail -> unavailable; else any warn -> degraded; else ready.
#[must_use]
pub fn fold_doctor_status(checks: &[DoctorCheckStatus]) -> DoctorReportStatus {
    let has_fail = checks.iter().any(|c| *c == DoctorCheckStatus::Fail);
    let has_warn = checks.iter().any(|c| *c == DoctorCheckStatus::Warn);
    if has_fail {
        DoctorReportStatus::Unavailable
    } else if has_warn {
        DoctorReportStatus::Degraded
    } else {
        DoctorReportStatus::Ready
    }
}

/// Process exit code for CLI doctor (unavailable -> 1 else 0).
#[must_use]
pub fn doctor_exit_code(status: DoctorReportStatus) -> i32 {
    match status {
        DoctorReportStatus::Unavailable => 1,
        DoctorReportStatus::Ready | DoctorReportStatus::Degraded => 0,
    }
}

/// Stable doctor profile id.
pub const DOCTOR_PROFILE: &str = "coderag_doctor";

/// Expected check ids from TS doctor probes (order stable).
pub const DOCTOR_CHECK_IDS: &[&str] = &[
    "rust_core",
    "cli_binary",
    "golden_fixture",
    "rust_engine_flag",
];

/// Warn message when CODERAG_USE_RUST_ENGINE=0 (TS probeRustEngineFlag).
pub const RUST_ENGINE_DISABLED_WARN: &str =
    "CODERAG_USE_RUST_ENGINE=0 forces the TypeScript indexer adapter path.";

/// Pure probe of engine flag env value (None = unset/enabled).
#[must_use]
pub fn probe_rust_engine_flag(env_value: Option<&str>) -> DoctorCheckStatus {
    match env_value {
        Some("0") => DoctorCheckStatus::Warn,
        _ => DoctorCheckStatus::Ok,
    }
}

/// Pure presence probes: path exists? (caller supplies bools - no FS in pure unit).
#[must_use]
pub fn probe_presence(present: bool, missing_is_fail: bool) -> DoctorCheckStatus {
    if present {
        DoctorCheckStatus::Ok
    } else if missing_is_fail {
        DoctorCheckStatus::Fail
    } else {
        DoctorCheckStatus::Warn
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fold_ready() {
        assert_eq!(
            fold_doctor_status(&[
                DoctorCheckStatus::Ok,
                DoctorCheckStatus::Ok,
                DoctorCheckStatus::Ok,
                DoctorCheckStatus::Ok,
            ]),
            DoctorReportStatus::Ready
        );
    }

    #[test]
    fn fold_degraded() {
        assert_eq!(
            fold_doctor_status(&[DoctorCheckStatus::Ok, DoctorCheckStatus::Warn]),
            DoctorReportStatus::Degraded
        );
        assert_eq!(doctor_exit_code(DoctorReportStatus::Degraded), 0);
    }

    #[test]
    fn fold_unavailable() {
        assert_eq!(
            fold_doctor_status(&[DoctorCheckStatus::Warn, DoctorCheckStatus::Fail]),
            DoctorReportStatus::Unavailable
        );
        assert_eq!(doctor_exit_code(DoctorReportStatus::Unavailable), 1);
    }

    #[test]
    fn engine_flag() {
        assert_eq!(probe_rust_engine_flag(Some("0")), DoctorCheckStatus::Warn);
        assert_eq!(probe_rust_engine_flag(None), DoctorCheckStatus::Ok);
        assert_eq!(probe_rust_engine_flag(Some("1")), DoctorCheckStatus::Ok);
    }

    #[test]
    fn presence() {
        assert_eq!(probe_presence(true, true), DoctorCheckStatus::Ok);
        assert_eq!(probe_presence(false, true), DoctorCheckStatus::Fail);
        assert_eq!(probe_presence(false, false), DoctorCheckStatus::Warn);
    }
}
