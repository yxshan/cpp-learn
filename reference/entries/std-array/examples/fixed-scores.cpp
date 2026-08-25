#include <array>
#include <iostream>

int main() {
    constexpr std::array<int, 3> scores{4, 7, 9};
    std::cout << scores.size() << ' ' << scores.front() << ' '
              << scores.back() << '\n';
}
