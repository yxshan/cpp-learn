#include <iostream>
#include <string_view>

int main() {
    constexpr std::string_view route = "api/v1/users";
    const auto slash = route.find('/');

    std::cout << "prefix=" << route.substr(0, slash) << '\n';
    std::cout << "suffix=" << route.substr(slash + 1) << '\n';
}
