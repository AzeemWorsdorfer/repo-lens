mod alias;
mod cli;
mod nested {
    pub mod leaf;
}

pub const MAIN_MESSAGE: &str = "ready";

fn main() {
    if cli::enabled() && !MAIN_MESSAGE.is_empty() {
        println!("{}", MAIN_MESSAGE);
    }
}
