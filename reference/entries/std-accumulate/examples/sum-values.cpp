#include <iostream>
#include <numeric>
#include <vector>

int main() {
    const std::vector<int> values{1, 2, 3, 4, 5};
    const int sum = std::accumulate(values.begin(), values.end(), 0);
    std::cout << "sum=" << sum << '\n';
}
