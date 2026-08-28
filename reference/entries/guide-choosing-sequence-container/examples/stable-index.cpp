#include <cstddef>
#include <iostream>
#include <vector>

int main() {
    std::vector<int> values{10};
    values.reserve(4);
    const std::size_t kept_index{};

    values.push_back(20);
    values.push_back(30);
    values.push_back(40);

    std::cout << values[kept_index] << ' ' << values.size() << '\n';
}
