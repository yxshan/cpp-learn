#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{3, 8, 13};
    for (const int value : values) {
        std::cout << value << (value == values.back() ? '\n' : ' ');
    }
}
