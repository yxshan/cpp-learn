#include <iostream>
#include <string>
#include <utility>

void inspect(const std::string&) {
    std::cout << "lvalue\n";
}

void inspect(std::string&&) {
    std::cout << "rvalue\n";
}

template<class T>
void relay(T&& value) {
    inspect(std::forward<T>(value));
}

int main() {
    std::string name{"learner"};
    relay(name);
    relay(std::string{"temporary"});
}
