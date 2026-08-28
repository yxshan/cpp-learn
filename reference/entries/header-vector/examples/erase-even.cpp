#include <cstddef>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{1, 2, 3, 4, 5};
    std::erase_if(values, [](int value) { return value % 2 == 0; });

    for (std::size_t index{}; index < values.size(); ++index) {
        std::cout << values[index]
                  << (index + 1 == values.size() ? '\n' : ' ');
    }
}
