#include <array>
#include <charconv>
#include <iostream>

int main() {
    std::array<char, 8> buffer{};
    const auto formatted = std::to_chars(buffer.data(), buffer.data() + buffer.size(), 255, 16);

    int value{};
    const auto parsed = std::from_chars(buffer.data(), formatted.ptr, value, 16);

    if (parsed.ec == std::errc{} && formatted.ec == std::errc{}) {
        std::cout << "value=" << value << '\n';
        std::cout << "hex=";
        std::cout.write(buffer.data(), formatted.ptr - buffer.data());
        std::cout << '\n';
    }
}
