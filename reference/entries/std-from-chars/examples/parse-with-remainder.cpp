#include <charconv>
#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view input = "200ms";
    int value{};
    const auto result = std::from_chars(input.data(), input.data() + input.size(), value);

    if (result.ec == std::errc{}) {
        std::cout << "value=" << value << '\n';
        const auto remaining =
            static_cast<std::size_t>(input.data() + input.size() - result.ptr);
        std::cout << "remainder=" << std::string_view(result.ptr, remaining) << '\n';
    }
}
