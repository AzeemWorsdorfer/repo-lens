#[path = "../extra/under_a_different_name.rs"]
mod renamed;

#[cfg(test)]
mod tests {
    use super::*;
}

pub fn lib_entry() -> i32 {
    renamed::value()
}
