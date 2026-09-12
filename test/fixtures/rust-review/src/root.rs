mod child;
mod missing;
#[path = "module.rs"]
mod worker;
#[path = "extra.rs"]
mod renamed;
mod outer {
    pub const VALUE: i32 = 3;
    mod service;
}

use crate::{outer::service::*};
use crate::missing::VALUE;
use crate::outer::VALUE;
use super::helper;
use child::VALUE;
use helper::VALUE;
