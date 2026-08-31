#include <iostream>
#include <memory>
#include <utility>

int main() {
    auto source = std::make_unique<int>(42);
    std::unique_ptr<int> destination = std::move(source);

    std::cout << std::boolalpha;
    std::cout << "source=" << static_cast<bool>(source) << '\n';
    std::cout << "destination=" << *destination << '\n';
}
