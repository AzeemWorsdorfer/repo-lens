mod child;
mod missing;
#[path = "main.rs"]
mod worker;
#[path = "extra.rs"]
mod renamed;
mod outer {
    mod service;
}

use crate::{outer::service::*};
use crate::missing::VALUE;
use child::VALUE;
use helper::VALUE;
