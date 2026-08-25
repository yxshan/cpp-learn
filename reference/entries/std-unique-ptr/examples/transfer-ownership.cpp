#include <iostream>
#include <memory>
#include <utility>

int main() {
    auto source = std::make_unique<int>(7);
    auto target = std::move(source);
    std::cout << static_cast<bool>(source) << ' ' << *target << '\n';
}
