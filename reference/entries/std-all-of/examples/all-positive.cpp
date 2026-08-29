#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{3, 7, 11};
    const bool positive = std::all_of(values.begin(), values.end(),
                                      [](const int value) { return value > 0; });
    std::cout << std::boolalpha << "positive=" << positive << '\n';
}
