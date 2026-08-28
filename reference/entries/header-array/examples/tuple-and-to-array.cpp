#include <array>
#include <iostream>

int main() {
    int raw[]{3, 5, 8};
    const auto values = std::to_array(raw);
    const auto [first, middle, last] = values;

    std::cout << first << ' ' << middle << ' ' << last << ' '
              << values.size() << '\n';
}
