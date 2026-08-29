#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{2, -1, 5, -3, 8};
    const auto new_end = std::remove_if(values.begin(), values.end(),
                                        [](const int value) {
                                            return value < 0;
                                        });
    values.erase(new_end, values.end());

    for (const int value : values) {
        std::cout << value << (value == values.back() ? '\n' : ' ');
    }
}
