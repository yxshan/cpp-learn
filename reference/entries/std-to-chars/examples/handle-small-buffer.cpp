#include <array>
#include <charconv>
#include <iostream>

int main() {
    std::array<char, 2> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), 2026);

    std::cout << std::boolalpha;
    std::cout << "too-small=" << (result.ec == std::errc::value_too_large) << '\n';
    std::cout << "ptr-at-end=" << (result.ptr == buffer.data() + buffer.size()) << '\n';
}
