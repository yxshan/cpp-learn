#include <algorithm>
#include <array>
#include <iostream>

int main() {
    std::array<int, 4> values{1, 2, 3, 4};
    std::reverse(values.begin(), values.end());

    for (std::size_t index = 0; index < values.size(); ++index) {
        std::cout << values[index] << (index + 1 == values.size() ? '\n' : ' ');
    }
}
