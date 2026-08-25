#include <array>
#include <iostream>

int main() {
    const std::array<int, 3> values{1, 2, 3};
    int sum{};
    for (const int value : values) {
        sum += value;
    }
    std::cout << sum << '\n';
}
