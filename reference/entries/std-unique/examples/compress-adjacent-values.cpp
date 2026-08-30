#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{1, 1, 2, 2, 3, 2};
    const auto logical_end = std::unique(values.begin(), values.end());
    values.erase(logical_end, values.end());

    for (std::size_t index = 0; index < values.size(); ++index) {
        std::cout << values[index] << (index + 1 == values.size() ? '\n' : ' ');
    }
}
