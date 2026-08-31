#include <iostream>
#include <string>
#include <tuple>

int main() {
    auto task = std::tuple{std::string{"compile"}, 2, true};
    auto& [name, priority, cached] = task;
    priority = 3;

    std::cout << std::boolalpha << "name=" << name
              << " priority=" << priority << " cached=" << cached << '\n';
}
