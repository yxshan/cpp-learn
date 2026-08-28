#include <iostream>
#include <memory>
#include <string>

int main() {
    auto label = std::make_unique<std::string>(4, 'C');
    std::cout << *label << '\n';
}
