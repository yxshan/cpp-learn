#include <iostream>
#include <optional>

std::optional<int> configured_port(bool enabled) {
    if (!enabled) return std::nullopt;
    return 8080;
}

int main() {
    std::cout << configured_port(true).value_or(80) << '\n';
}
