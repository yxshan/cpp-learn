#include <expected>
#include <iostream>
#include <string>

std::expected<int, std::string> parse_positive(int input) {
    if (input > 0) {
        return input;
    }
    return std::unexpected(std::string{"not positive"});
}

int main() {
    const auto accepted = parse_positive(42);
    const auto rejected = parse_positive(-3);

    std::cout << "value=" << accepted.value() << '\n';
    std::cout << "error=" << rejected.error() << '\n';
}
