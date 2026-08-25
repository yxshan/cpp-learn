#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{10, 20, 30, 40};
    const auto position = std::find(values.begin(), values.end(), 30);
    std::cout << std::distance(values.begin(), position) << '\n';
}
