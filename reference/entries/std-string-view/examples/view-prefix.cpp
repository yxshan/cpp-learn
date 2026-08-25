#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view language = "C++20";
    std::cout << language.substr(0, 3) << '\n';
}
