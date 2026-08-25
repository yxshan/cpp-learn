#include <iostream>
#include <memory>

int main() {
    auto count = std::make_unique<int>(3);
    std::cout << *count << '\n';
}
