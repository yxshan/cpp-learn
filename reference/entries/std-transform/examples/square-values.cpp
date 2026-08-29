#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{1, 2, 3, 4};
    std::vector<int> squares(values.size());
    std::transform(values.begin(), values.end(), squares.begin(),
                   [](const int value) { return value * value; });

    for (const int square : squares) {
        std::cout << square << (square == squares.back() ? '\n' : ' ');
    }
}
