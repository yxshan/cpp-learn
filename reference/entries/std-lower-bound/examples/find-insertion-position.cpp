#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{10, 20, 30, 40};
    const auto position = std::lower_bound(values.begin(), values.end(), 25);
    std::cout << "index=" << std::distance(values.begin(), position)
              << " value=" << *position << '\n';
}
