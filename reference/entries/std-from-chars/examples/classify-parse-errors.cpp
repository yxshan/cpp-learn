#include <charconv>
#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view invalid = "ms";
    constexpr std::string_view huge = "999999999999999999999999";
    int value{};

    const auto invalid_result =
        std::from_chars(invalid.data(), invalid.data() + invalid.size(), value);
    const auto huge_result = std::from_chars(huge.data(), huge.data() + huge.size(), value);

    std::cout << std::boolalpha;
    std::cout << "invalid=" << (invalid_result.ec == std::errc::invalid_argument) << '\n';
    std::cout << "out-of-range=" << (huge_result.ec == std::errc::result_out_of_range)
              << '\n';
}
