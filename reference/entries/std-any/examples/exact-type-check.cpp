#include <any>
#include <iostream>

int main() {
    std::any value = 42;

    std::cout << "int=" << std::any_cast<int>(value) << '\n';
    std::cout << std::boolalpha
              << "double=" << (std::any_cast<double>(&value) != nullptr)
              << '\n';
}
