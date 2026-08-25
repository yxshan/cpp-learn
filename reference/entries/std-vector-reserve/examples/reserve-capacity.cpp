#include <iostream>
#include <vector>

int main() {
    std::vector<int> values;
    values.reserve(3);

    std::cout << values.size() << ' ' << std::boolalpha
              << (values.capacity() >= 3) << '\n';

    values.push_back(10);
    values.push_back(20);
    values.push_back(30);
    std::cout << values.size() << '\n';
}
