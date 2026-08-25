#include <iostream>
#include <memory>

int main() {
    const auto value = std::make_unique<int>(42);
    std::cout << *value << '\n';
}
