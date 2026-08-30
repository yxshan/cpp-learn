#include <iostream>
#include <memory>

int main() {
    const auto service = std::make_shared<int>(42);
    const auto handler = service;

    std::cout << "value=" << *handler << '\n';
    std::cout << "owners=" << service.use_count() << '\n';
}
