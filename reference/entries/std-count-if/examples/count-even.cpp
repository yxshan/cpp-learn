#include <algorithm>
#include <iostream>
#include <vector>

int main() {
    const std::vector<int> values{1, 2, 4, 7, 8};
    const auto count = std::count_if(values.begin(), values.end(),
                                     [](const int value) {
                                         return value % 2 == 0;
                                     });
    std::cout << "even=" << count << '\n';
}
