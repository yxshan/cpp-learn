#include <array>
#include <charconv>
#include <iostream>
#include <string_view>

int main() {
    std::array<char, 8> buffer{};
    const auto result = std::to_chars(buffer.data(), buffer.data() + buffer.size(), 255, 16);

    if (result.ec == std::errc{}) {
        const auto length = static_cast<std::size_t>(result.ptr - buffer.data());
        std::cout << "hex=" << std::string_view(buffer.data(), length) << '\n';
    }
}
