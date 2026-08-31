#include <iostream>
#include <string>
#include <utility>

struct Job {
    std::string name;
    int priority;
};

template<class T, class... Args>
T make_box(Args&&... args) {
    return T{std::forward<Args>(args)...};
}

int main() {
    const Job job = make_box<Job>(std::string{"compile"}, 2);
    std::cout << "job=" << job.name << " priority=" << job.priority << '\n';
}
