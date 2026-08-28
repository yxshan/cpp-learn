#include <charconv>
#include <iostream>
#include <optional>
#include <string_view>
#include <system_error>

std::optional<int> parse_port(std::string_view text) {
    int port{};
    const auto result =
        std::from_chars(text.data(), text.data() + text.size(), port);
    if (result.ec != std::errc{} || result.ptr != text.data() + text.size() ||
        port < 1 || port > 65535) {
        return std::nullopt;
    }
    return port;
}

int main() {
    std::cout << parse_port("8080").value_or(80) << '\n';
    std::cout << parse_port("invalid").value_or(80) << '\n';
}
