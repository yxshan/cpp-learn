#include <iostream>
#include <memory>

int main() {
    const auto unique = std::make_unique<int>(7);
    const auto shared = std::make_shared<int>(42);
    const auto shared_copy = shared;

    std::cout << "unique=" << *unique << '\n';
    std::cout << "shared-count=" << shared_copy.use_count() << '\n';
}
