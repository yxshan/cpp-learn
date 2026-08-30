#include <iostream>
#include <memory>

int main() {
    const auto values = std::make_shared<int[]>(3);
    values[0] = 2;
    values[1] = 4;
    values[2] = 6;

    std::cout << values[0] << ' ' << values[1] << ' ' << values[2] << '\n';
}
