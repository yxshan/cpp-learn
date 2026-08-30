#include <algorithm>
#include <array>
#include <iostream>
#include <string_view>

int main() {
    std::array<std::string_view, 3> route{"api", "users", "details"};
    std::reverse(route.begin(), route.end());

    for (std::size_t index = 0; index < route.size(); ++index) {
        std::cout << route[index] << (index + 1 == route.size() ? '\n' : ' ');
        if (index + 1 < route.size()) {
            std::cout << "<- ";
        }
    }
}
