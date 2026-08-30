#include <iostream>
#include <numeric>
#include <vector>

int main() {
    std::vector<int> values(4);
    std::iota(values.begin(), values.end(), 4);

    for (const int value : values) {
        std::cout << value << (value == values.back() ? '\n' : ' ');
    }
    std::cout << "sum="
              << std::accumulate(values.begin(), values.end(), 0) << '\n';
}
