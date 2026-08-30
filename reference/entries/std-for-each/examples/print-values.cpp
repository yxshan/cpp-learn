#include <algorithm>
#include <array>
#include <iostream>

int main() {
    std::array<int, 3> values{1, 2, 3};
    std::for_each(values.begin(), values.end(), [](int& value) { value *= 2; });

    for (std::size_t index = 0; index < values.size(); ++index) {
        std::cout << values[index] << (index + 1 == values.size() ? '\n' : ' ');
    }
}
