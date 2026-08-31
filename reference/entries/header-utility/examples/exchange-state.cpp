#include <iostream>
#include <string>
#include <utility>

int main() {
    std::string state{"idle"};
    const std::string old = std::exchange(state, "running");

    std::cout << "old=" << old << '\n';
    std::cout << "current=" << state << '\n';
}
